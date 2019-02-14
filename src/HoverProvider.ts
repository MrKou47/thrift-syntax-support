import { HoverProvider, TextDocument, Position, Hover, Range } from 'vscode';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';
import { genASTHelper, wordNodeFilter, genZeroBasedNum } from './utils';

class ThriftHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): Thenable<Hover | null> {
    const word = document.getText(document.getWordRangeAtPosition(position));
    const rawFile = document.getText();
    const thriftParseResult = parse(rawFile);
    if (thriftParseResult.type === SyntaxType.ThriftDocument) {
      const helper = genASTHelper(thriftParseResult);
      const wordNode = helper(wordNodeFilter(word))[0];
      if (!wordNode) return Promise.resolve(null);
      const { loc } = wordNode;
      const { start, end } = loc;
      const rawCode = document.getText(new Range(
        new Position(genZeroBasedNum(start.line), genZeroBasedNum(start.column)),
        new Position(genZeroBasedNum(end.line), genZeroBasedNum(end.column))
      ));
      return Promise.resolve(new Hover({ language: 'thrift', value: rawCode }));
    }
    return Promise.resolve(new Hover(word));
  }
}

export default ThriftHoverProvider;
