import { Position, Range, TextDocument, workspace } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ThriftDocument,
  ThriftStatement,
  SyntaxType,
  TextLocation,
  IncludeDefinition,
} from '@creditkarma/thrift-parser';

export type filterFnType = (item: ThriftStatement, index: number) => any;

export type GetReturnType<original> =
  original extends (...x: any[]) => infer returnType ? returnType : never;

export const genZeroBasedNum = (num: number) => num - 1;

export const wordNodeFilter = (word: string) =>
  (item: ThriftStatement, index: number) => {
    if (
      item.type !== SyntaxType.IncludeDefinition &&
      item.type !== SyntaxType.CppIncludeDefinition &&
      item.name.value === word
    ) {
      return item;
    }
  };

export const includeNodeFilter = () =>
  (item: ThriftStatement, index: number) => {
    if (
      item.type === SyntaxType.IncludeDefinition
    ) {
      return item;
    }
  };

export const genRange = (loc: TextLocation) => {
  const { start, end } = loc;
  const startPosition = new Position(
    genZeroBasedNum(start.line),
    genZeroBasedNum(start.column)
  );
  const endPosition = new Position(
    genZeroBasedNum(end.line),
    genZeroBasedNum(end.column)
  );
  return new Range(startPosition, endPosition);
};

interface IncludeNode extends IncludeDefinition {
  filePath: string;
  fileName: string;
  raw?: string;
}

export class ASTHelper {
  ast: ThriftDocument;
  document: TextDocument;
  readonly includeNodes: IncludeNode[];
  constructor(ast: ThriftDocument, document: TextDocument) {
    this.ast = ast;
    this.document = document;
    this.includeNodes = this._findIncludeNodes();
  }

  filter = <fn extends filterFnType>(originalFn: fn) => {
    const result = (this.ast.body.filter(originalFn) as GetReturnType<fn>[]);
    return result;
  }

  _findIncludeNodes = (): IncludeNode[] => {
    const { filter, document } = this;
    return filter(includeNodeFilter()).map(item => {
      const { value } = item.path;
      const thriftRoot = workspace.getConfiguration('thrift').get<string>('root')
          || path.dirname(document.fileName);
      const filePath = path.resolve(thriftRoot, value);
      const rebuildNode = ({
        ...item,
        filePath,
        fileName: path.parse(value).name,
      });
      try {
        (rebuildNode as IncludeNode).raw = fs.readFileSync(filePath, { encoding: 'utf8' });
      } catch (error) {
        console.log(error);
      }
      return rebuildNode;
    });
  }

  findNodesByInput = (input: string) => {
    return this.filter((item, index) => {
      if (
        item.type !== SyntaxType.IncludeDefinition &&
        item.type !== SyntaxType.CppIncludeDefinition &&
        item.name.value.indexOf(input) > -1
      ) {
        return item;
      }
    });
  }

  findNodesByWord = (word: string) => {
    return this.filter(wordNodeFilter(word));
  }

  findNodeByWord = (word: string) => {
    return this.findNodesByWord(word)[0];
  }
}