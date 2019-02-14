import { HoverProvider, TextDocument, Position, Hover, workspace, Uri, MarkdownString } from 'vscode';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';
import { ASTHelper } from './utils';

const { openTextDocument } = workspace;

class ThriftHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): Thenable<Hover | null> {
    const word = document.getText(document.getWordRangeAtPosition(position));
    const rawFile = document.getText();
    const processor = (rawText: string, doc: TextDocument): Thenable<Hover | null> => {
      const thriftParseResult = parse(rawText);
      if (thriftParseResult.type === SyntaxType.ThriftDocument) {
        const helper = new ASTHelper(thriftParseResult, doc);
        const wordNode = helper.findNodeByWord(word);
        const { includeNodes } = helper;
        if (wordNode) {
          return Promise.resolve(new Hover(new MarkdownString(`(${wordNode.type}) **${wordNode.name.value}**`)));
        }
        const includeNode = includeNodes.find(item => {
          return item.raw.indexOf(word) > -1;
        });
        if (includeNode) {
          const { filePath, raw } = includeNode;
          return openTextDocument(Uri.file(filePath)).then((iDoc) => {
            return processor(raw, iDoc);
          });
        }
      }
      return Promise.resolve(null);
    };
    return processor(rawFile, document);
  }
}

export default ThriftHoverProvider;
