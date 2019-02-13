import { HoverProvider, TextDocument, Position, Hover } from 'vscode';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';
import { genASTHelper, wordNodeFilter } from './utils';

class ThriftHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): Thenable<Hover | null> {
    const word = document.getText(document.getWordRangeAtPosition(position));
    const rawFile = document.getText();
    const thriftParseResult = parse(rawFile);
    if (thriftParseResult.type === SyntaxType.ThriftDocument) {
      console.log(word);
      const helper = genASTHelper(thriftParseResult);
      const wordNode = helper(wordNodeFilter(word))[0];
      console.log(wordNode);
    }
    return Promise.resolve(new Hover(word));
  }
}

export default ThriftHoverProvider;
