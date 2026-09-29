import {
  Uri,
  CancellationToken,
  Location,
  Position,
  Range,
  ReferenceContext,
  ReferenceProvider,
  TextDocument,
  workspace,
} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  EnumDefinition,
  Identifier,
  parse,
  SyntaxType,
  TextLocation,
  ThriftDocument,
  ThriftStatement,
} from '@creditkarma/thrift-parser';

type TargetKind = 'symbol' | 'enumMember' | 'includeAlias';

interface ReferenceTarget {
  kind: TargetKind;
  /** Last segment of the qualified name, e.g. "Location2" / "TWEET" / "example2". */
  name: string;
  /** Enum name when kind is enumMember. */
  enumName?: string;
  /** Absolute path of the file where the target is declared. */
  file: string;
  /** Location of the declaration identifier, used when includeDeclaration is on. */
  declarationLoc?: TextLocation;
}

interface IncludeRef {
  /** Prefix used in the including file, e.g. "example2" for include "example2.thrift". */
  alias: string;
  resolved: string;
}

interface CollectedIdentifiers {
  /** Identifiers appearing in type/value positions (real references). */
  usages: Identifier[];
  /** Start indexes of declaration identifiers that must not be treated as usages. */
  declarations: Set<number>;
}

const WORD_PATTERN = /^[A-Za-z_]\w*$/;

/**
 * Statement types whose `name` property is a declared identifier rather than a
 * reference (field names, function names, enum members ...).
 */
const DECLARATION_NAME_OWNERS = new Set<SyntaxType>([
  SyntaxType.StructDefinition,
  SyntaxType.UnionDefinition,
  SyntaxType.ExceptionDefinition,
  SyntaxType.EnumDefinition,
  SyntaxType.ServiceDefinition,
  SyntaxType.ConstDefinition,
  SyntaxType.TypedefDefinition,
  SyntaxType.FieldDefinition,
  SyntaxType.FunctionDefinition,
  SyntaxType.EnumMember,
]);

const SKIP_VISITOR_KEYS = new Set(['loc', 'type', 'comments', 'tokens', 'modifiers', 'annotations']);

const normalizePath = (p: string): string =>
  (process.platform === 'win32' ? p.toLowerCase() : p);

const sameFile = (a: string, b: string): boolean =>
  normalizePath(a) === normalizePath(b);

const parseThrift = (raw: string): ThriftDocument | null => {
  try {
    const ast = parse(raw);
    return ast.type === SyntaxType.ThriftDocument ? ast : null;
  } catch (error) {
    // thrift-parser can throw on malformed input (errors without a source location);
    // an unparseable file simply contributes no references.
    console.log(`thrift parse failed: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Build a precise single-line range for a (part of an) identifier.
 * thrift-parser loc values are 1-based, VS Code positions are 0-based.
 */
const buildIdentifierRange = (
  loc: TextLocation,
  segmentOffset: number,
  length: number
): Range => {
  const line = loc.start.line - 1;
  const startChar = loc.start.column - 1 + segmentOffset;
  return new Range(
    new Position(line, startChar),
    new Position(line, startChar + length)
  );
};

/**
 * Collect dot-separated qualifier segments right before the focused word.
 * e.g. focusing MEMBER in `example2.EnumX.MEMBER` returns ["example2", "EnumX"].
 */
const getPrefixSegments = (document: TextDocument, wordStart: Position): string[] => {
  const offset = document.offsetAt(wordStart);
  const before = document.getText().slice(0, offset);
  const matched = /(?:[A-Za-z_]\w*\.)+$/.exec(before);
  if (!matched) {
    return [];
  }
  // "example2.EnumX.".split('.') -> ["example2", "EnumX", ""]
  return matched[0].split('.').slice(0, -1);
};

/** Resolve every include statement of a parsed file to an alias and absolute path. */
const collectIncludes = (ast: ThriftDocument, filePath: string): IncludeRef[] => {
  const thriftRoot = workspace.getConfiguration('thrift').get<string>('root')
    || path.dirname(filePath);
  const includes: IncludeRef[] = [];
  for (const stmt of ast.body) {
    if (stmt.type === SyntaxType.IncludeDefinition) {
      const rawPath = stmt.path.value;
      includes.push({
        alias: path.parse(rawPath).name,
        resolved: path.resolve(thriftRoot, rawPath),
      });
    }
  }
  return includes;
};

/** Read file content, preferring the live (possibly unsaved) editor buffer. */
const readContent = (file: string): string | null => {
  const openDoc = workspace.textDocuments.find(doc => sameFile(doc.uri.fsPath, file));
  if (openDoc) {
    return openDoc.getText();
  }
  try {
    return fs.readFileSync(file, { encoding: 'utf8' });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const findTopLevelNameLoc = (ast: ThriftDocument, name: string): TextLocation | null => {
  for (const stmt of ast.body) {
    if (
      stmt.type === SyntaxType.IncludeDefinition
      || stmt.type === SyntaxType.CppIncludeDefinition
      || stmt.type === SyntaxType.NamespaceDefinition
    ) {
      continue;
    }
    const namedStmt = stmt as ThriftStatement & { name?: Identifier };
    if (namedStmt.name && namedStmt.name.value === name) {
      return namedStmt.name.loc;
    }
  }
  return null;
};

const findEnumMemberLoc = (
  ast: ThriftDocument,
  enumName: string,
  memberName: string
): TextLocation | null => {
  const enumStmt = ast.body.find(
    stmt => stmt.type === SyntaxType.EnumDefinition && stmt.name.value === enumName
  ) as EnumDefinition | undefined;
  if (!enumStmt) {
    return null;
  }
  const member = enumStmt.members.find(item => item.name.value === memberName);
  return member ? member.name.loc : null;
};

/**
 * Walk the AST and split identifiers into real usages and declarations.
 * Qualified references like "example2.Location2" / "TweetType.TWEET" are single
 * Identifier nodes in thrift-parser, so every Identifier is collected as a whole
 * and qualified matching is done by value splitting later.
 */
const collectIdentifiers = (ast: ThriftDocument): CollectedIdentifiers => {
  const usages: Identifier[] = [];
  const declarations = new Set<number>();

  const visit = (
    node: unknown,
    parentType: SyntaxType | undefined,
    key: string | undefined
  ): void => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const current = node as { type?: SyntaxType } & Record<string, unknown>;
    if (typeof current.type !== 'string') {
      return;
    }
    // Namespace scopes/names are unrelated to user symbols, skip the statement.
    if (current.type === SyntaxType.NamespaceDefinition) {
      return;
    }
    if (current.type === SyntaxType.Identifier) {
      const identifier = node as Identifier;
      if (key === 'name' && parentType && DECLARATION_NAME_OWNERS.has(parentType)) {
        declarations.add(identifier.loc.start.index);
      } else {
        usages.push(identifier);
      }
      return;
    }
    for (const childKey of Object.keys(current)) {
      if (SKIP_VISITOR_KEYS.has(childKey)) {
        continue;
      }
      const child = current[childKey];
      if (Array.isArray(child)) {
        child.forEach(item => visit(item, current.type, childKey));
      } else if (child && typeof child === 'object') {
        visit(child, current.type, childKey);
      }
    }
  };

  ast.body.forEach(stmt => visit(stmt, undefined, 'body'));
  return { usages, declarations };
};

class ThriftReferenceProvider implements ReferenceProvider {
  public async provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken
  ): Promise<Location[] | null> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }
    const word = document.getText(wordRange);
    if (!word || !WORD_PATTERN.test(word)) {
      return null;
    }

    const currentFile = document.fileName;
    const currentRaw = document.getText();
    const currentAst = parseThrift(currentRaw);
    if (!currentAst) {
      return null;
    }
    const currentIncludes = collectIncludes(currentAst, currentFile);
    const prefixes = getPrefixSegments(document, wordRange.start);

    const target = this.resolveTarget(
      word,
      prefixes,
      currentFile,
      currentAst,
      currentIncludes
    );
    if (!target || token.isCancellationRequested) {
      return target ? [] : null;
    }

    return this.searchReferences(target, context.includeDeclaration, currentFile, currentRaw, currentIncludes, token);
  }

  /**
   * Resolve the focused word into a declared symbol.
   * Supports: bare names, "EnumName.MEMBER", "includeAlias.TypeName",
   * "includeAlias.EnumName.MEMBER" and include aliases themselves.
   */
  private resolveTarget(
    word: string,
    prefixes: string[],
    currentFile: string,
    currentAst: ThriftDocument,
    currentIncludes: IncludeRef[]
  ): ReferenceTarget | null {
    // Cursor on an include alias (e.g. the "types" in `types.Location` or the
    // file name inside an include statement).
    if (prefixes.length === 0 && currentIncludes.some(item => item.alias === word)) {
      return { kind: 'includeAlias', name: word, file: currentFile };
    }

    if (prefixes.length === 1) {
      const head = prefixes[0];

      // Local enum member access: EnumName.MEMBER
      const memberLoc = findEnumMemberLoc(currentAst, head, word);
      if (memberLoc) {
        return {
          kind: 'enumMember',
          name: word,
          enumName: head,
          file: currentFile,
          declarationLoc: memberLoc,
        };
      }

      // Top-level symbol from an included file: includeAlias.TypeName
      // (TypeName may itself be an enum used as a type).
      const aliasInclude = currentIncludes.find(item => item.alias === head);
      if (aliasInclude) {
        const raw = readContent(aliasInclude.resolved);
        const ast = raw ? parseThrift(raw) : null;
        if (ast) {
          const declarationLoc = findTopLevelNameLoc(ast, word);
          if (declarationLoc) {
            return {
              kind: 'symbol',
              name: word,
              file: aliasInclude.resolved,
              declarationLoc,
            };
          }
        }
      }

      return null;
    }

    if (prefixes.length === 2) {
      // Enum member from an included file: includeAlias.EnumName.MEMBER
      const [alias, enumName] = prefixes;
      const aliasInclude = currentIncludes.find(item => item.alias === alias);
      if (!aliasInclude) {
        return null;
      }
      const raw = readContent(aliasInclude.resolved);
      const ast = raw ? parseThrift(raw) : null;
      if (!ast) {
        return null;
      }
      const memberLoc = findEnumMemberLoc(ast, enumName, word);
      if (memberLoc) {
        return {
          kind: 'enumMember',
          name: word,
          enumName,
          file: aliasInclude.resolved,
          declarationLoc: memberLoc,
        };
      }
      return null;
    }

    // Thrift allows at most one include alias segment before a symbol.
    if (prefixes.length > 2) {
      return null;
    }

    // Bare word: a top-level symbol in the current file ...
    const localLoc = findTopLevelNameLoc(currentAst, word);
    if (localLoc) {
      return { kind: 'symbol', name: word, file: currentFile, declarationLoc: localLoc };
    }

    // ... or the cursor is resting on an enum member declaration (e.g. RED in `enum Color { RED }`)
    for (const stmt of currentAst.body) {
      if (stmt.type === SyntaxType.EnumDefinition) {
        const member = stmt.members.find(item => item.name.value === word);
        if (member) {
          return {
            kind: 'enumMember',
            name: word,
            enumName: stmt.name.value,
            file: currentFile,
            declarationLoc: member.name.loc,
          };
        }
      }
    }

    // ... or in one of the included files.
    for (const include of currentIncludes) {
      const raw = readContent(include.resolved);
      const ast = raw ? parseThrift(raw) : null;
      if (!ast) {
        continue;
      }
      const declarationLoc = findTopLevelNameLoc(ast, word);
      if (declarationLoc) {
        return {
          kind: 'symbol',
          name: word,
          file: include.resolved,
          declarationLoc,
        };
      }
    }

    return null;
  }

  private async searchReferences(
    target: ReferenceTarget,
    includeDeclaration: boolean,
    currentFile: string,
    currentRaw: string,
    currentIncludes: IncludeRef[],
    token: CancellationToken
  ): Promise<Location[]> {
    const locations: Location[] = [];
    const seen = new Set<string>();

    const addLocation = (
      file: string,
      loc: TextLocation,
      segmentOffset: number,
      length: number
    ): void => {
      const key = `${normalizePath(file)}:${loc.start.index + segmentOffset}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      locations.push(new Location(Uri.file(file), buildIdentifierRange(loc, segmentOffset, length)));
    };

    // Include alias references only exist inside the file owning the include statement.
    if (target.kind === 'includeAlias') {
      const currentDocumentAst = parseThrift(currentRaw);
      if (currentDocumentAst) {
        const { usages } = collectIdentifiers(currentDocumentAst);
        for (const identifier of usages) {
          const segments = identifier.value.split('.');
          if (segments.length >= 2 && segments[0] === target.name) {
            addLocation(currentFile, identifier.loc, 0, target.name.length);
          }
        }
      }
      return locations;
    }

    const searchFile = (
      raw: string,
      file: string,
      qualifier: string
    ): void => {
      const ast = parseThrift(raw);
      if (!ast) {
        return;
      }
      const { usages, declarations } = collectIdentifiers(ast);

      // Offset of the matched last segment inside the identifier node.
      // Usually 0, but some nodes (e.g. `extends Base`) have an over-wide loc
      // that starts at a preceding keyword, so locate the value in the source span.
      const nameOffsetIn = (identifier: Identifier): number => {
        const span = raw.slice(identifier.loc.start.index, identifier.loc.end.index);
        const valueIndex = span.lastIndexOf(identifier.value);
        const base = valueIndex >= 0 ? valueIndex : 0;
        return base + identifier.value.length - target.name.length;
      };

      if (target.kind === 'symbol') {
        for (const identifier of usages) {
          if (declarations.has(identifier.loc.start.index)) {
            continue;
          }
          const segments = identifier.value.split('.');
          const matchesName = segments[segments.length - 1] === target.name;
          const matchesQualifier = segments.slice(0, -1).join('.') === qualifier;
          if (matchesName && matchesQualifier) {
            addLocation(file, identifier.loc, nameOffsetIn(identifier), target.name.length);
          }
        }
      } else {
        const fullQualifier = qualifier
          ? `${qualifier}.${target.enumName}`
          : target.enumName as string;
        for (const identifier of usages) {
          if (declarations.has(identifier.loc.start.index)) {
            continue;
          }
          const segments = identifier.value.split('.');
          const matchesName = segments[segments.length - 1] === target.name;
          const matchesQualifier = segments.slice(0, -1).join('.') === fullQualifier;
          if (matchesName && matchesQualifier) {
            addLocation(file, identifier.loc, nameOffsetIn(identifier), target.name.length);
          }
        }
      }

      // The declaration itself only exists in the defining file (qualifier === '').
      if (includeDeclaration && qualifier === '' && target.declarationLoc) {
        addLocation(file, target.declarationLoc, 0, target.name.length);
      }
    };

    // 1. The defining file itself.
    if (sameFile(currentFile, target.file)) {
      searchFile(currentRaw, target.file, '');
    } else {
      const raw = readContent(target.file);
      if (raw) {
        searchFile(raw, target.file, '');
      }
    }

    // 2. Every workspace thrift file that includes the defining file.
    const candidates = new Map<string, { raw: string; alias: string; file: string }>();
    if (!sameFile(currentFile, target.file)) {
      const include = currentIncludes.find(item => sameFile(item.resolved, target.file));
      if (include) {
        candidates.set(normalizePath(currentFile), {
          raw: currentRaw,
          alias: include.alias,
          file: currentFile,
        });
      }
    }

    const uris = await workspace.findFiles(
      '**/*.thrift',
      '**/{node_modules,out,dist,.vscode-test}/**'
    );
    for (const uri of uris) {
      if (token.isCancellationRequested) {
        return locations;
      }
      const file = uri.fsPath;
      if (sameFile(file, target.file) || candidates.has(normalizePath(file))) {
        continue;
      }
      const raw = readContent(file);
      if (!raw) {
        continue;
      }
      const ast = parseThrift(raw);
      if (!ast) {
        continue;
      }
      const include = collectIncludes(ast, file).find(item => sameFile(item.resolved, target.file));
      if (include) {
        candidates.set(normalizePath(file), { raw, alias: include.alias, file });
      }
    }

    candidates.forEach(candidate => {
      searchFile(candidate.raw, candidate.file, candidate.alias);
    });

    return locations;
  }
}

export default ThriftReferenceProvider;
