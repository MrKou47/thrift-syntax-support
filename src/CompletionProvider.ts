import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionItemKind } from 'vscode';
import * as fs from 'fs';
import { ASTHelper } from './utils';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';

// const { StructDefinition,  EnumDefinition, ConstDefinition, ExceptionDefinition, IncludeDefinition } = SyntaxType;

export enum CustomeSyntaxKind {
  StructDefinition = CompletionItemKind.Struct,
  EnumDefinition = CompletionItemKind.Enum,
  ConstDefinition = CompletionItemKind.Constant,
  ExceptionDefinition = CompletionItemKind.Property,
  IncludeDefinition = CompletionItemKind.Module,
}

const keyWords = [
  'include',
  'cpp_include',
  'namespace',
  'const',
  'typedef',
  'enum',
  'struct',
  'union',
  'exception',
  'extends',
  'service',
  'required',
  'optional',
  'oneway',
  'void',
  'throws',
  'bool',
  'byte',
  'i8',
  'i16',
  'i32',
  'i64',
  'double',
  'string',
  'binary',
  'slist',
  'map',
  'set',
  'list',
  'cpp_type'
];

const keywords2CompletionItem = () =>
  keyWords.map(item => new CompletionItem(item, CompletionItemKind.Keyword));

class ThriftCompletionItemProvider implements CompletionItemProvider {
  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken):Thenable<CompletionItem[]> {
    const word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
    let raw = '';
    try {
      raw = fs.readFileSync(document.fileName, { encoding: 'utf8' });
    } catch (error) {}
    const ast = parse(raw);
    const completionItems: CompletionItem[] = [];
    if (ast.type === SyntaxType.ThriftDocument) {
      const helper = new ASTHelper(ast, document);
      const wordNodes = helper.findNodesByInput(word);
      wordNodes.forEach(item => {
        completionItems.push(
          new CompletionItem(item.name.value, CustomeSyntaxKind[item.type])
        );
      });
    }
    return new Promise(function (resolve, reject) {
      Promise.all([
        keywords2CompletionItem(),
        completionItems,
      ])
      .then(function (results) {
          const suggestions = Array.prototype.concat.apply([], results);
          resolve(suggestions);
      })
      .catch(err => { reject(err); });
    });
  }
}

export default ThriftCompletionItemProvider;