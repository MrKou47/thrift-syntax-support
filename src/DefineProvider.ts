import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, Range } from 'vscode';
import {
  parse,
  SyntaxType,
} from '@creditkarma/thrift-parser';
import { wordNodeFinder, genZeroBasedNum } from './utils';

class ThriftDefineProvider implements DefinitionProvider {
  provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Location | null> {
    const wordRange = document.getWordRangeAtPosition(position);
    let word = document.getText(wordRange);
    console.log('word: ', word);
    const { fileName } = document;
    const rawFile = document.getText();
    const thriftParseResult = parse(rawFile);
    console.log(thriftParseResult);
    switch (thriftParseResult.type) {
      case "ThriftDocument":
        const wordNode = wordNodeFinder(thriftParseResult, word);
        if (wordNode) {
          console.log(wordNode);
          const { name: { loc } } = wordNode;
          const { start, end } = loc;
          const startPosition = new Position(
            genZeroBasedNum(start.line),
            genZeroBasedNum(start.column)
          );
          const endPosition = new Position(
            genZeroBasedNum(end.line), 
            genZeroBasedNum(end.column)
          );
          return Promise.resolve(
            new Location(
              Uri.file(fileName),
              new Range(startPosition, endPosition)
            )
          );
        } else {
          return Promise.resolve(null);
        }
      case "ThriftErrors":
        return Promise.reject('parse thrift file error.');
      default:
        return Promise.resolve(null);
    }
    return new Promise(() => {});
  }
}

export default ThriftDefineProvider;
