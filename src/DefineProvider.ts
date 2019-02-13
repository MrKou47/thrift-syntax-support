import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, Range } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  parse,
  SyntaxType,
  TextLocation,
} from '@creditkarma/thrift-parser';
import { genZeroBasedNum, genASTHelper, wordNodeFilter, includeNodeFilter } from './utils';

class ThriftDefineProvider implements DefinitionProvider {
  genLocation(loc: TextLocation, filePath: string) {
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
        Uri.file(filePath),
        new Range(startPosition, endPosition)
      )
    );
  }

  provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Location | null> {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    const rawFile = document.getText();
    const processor = (raw: string, filePath?: string): Thenable<Location | null> => {
      const thriftParseResult = parse(raw);
      if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
        return Promise.resolve(null);
      }
      const helper = genASTHelper(thriftParseResult);
      const wordNodeList = helper(wordNodeFilter(word));
      const includeNodeList = helper(includeNodeFilter()).map(item => {
        const { value } = item.path;
        return ({
          ...item,
          filePath: path.resolve(path.dirname(document.fileName), value),
          fileName: path.parse(value).name,
        });
      });
      // if focus on thrift file name, redirect to this thrift file.
      const pathItem = includeNodeList.find(item => item.fileName === word);
      if (pathItem) {
        return Promise.resolve(
          new Location(
            Uri.file(pathItem.filePath),
            new Position(0, 0)
          )
        );
      }
      // if can find focused word in this file, autojump
      if (wordNodeList.length) {
        const { name: { loc } } = wordNodeList[0];
        return this.genLocation(loc, filePath);
      } else {
        const includeNode = includeNodeList.find(item => {
          const rawCode = fs.readFileSync(item.filePath, { encoding: 'utf8' });
          return rawCode.indexOf(word) > -1;
        });
        if (includeNode) {
          const rawCode = fs.readFileSync(includeNode.filePath, { encoding: 'utf8' });
          return processor(rawCode, includeNode.filePath);
        }
        return Promise.resolve(null);
      }
    };
    return processor(rawFile, document.fileName);
    return new Promise(() => {});
  }
}

export default ThriftDefineProvider;
