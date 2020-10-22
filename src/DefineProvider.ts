import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, Range } from 'vscode';
import {
  parse,
  SyntaxType,
  TextLocation,
} from '@creditkarma/thrift-parser';
import { genRange, ASTHelper } from './utils';

const genPosByShift = (pos: Position, shift = 0) => pos.with(pos.line, pos.character + shift);

class ThriftDefineProvider implements DefinitionProvider {
  genLocation(loc: TextLocation, filePath: string) {
    return Promise.resolve(
      new Location(
        Uri.file(filePath),
        genRange(loc)
      )
    );
  }

  provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Location | null> {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    let prevWord = '';
    const leftCharacter = document.getText(
      new Range(
        genPosByShift(wordRange.start, -1),
        wordRange.start)
    );
    if (leftCharacter && leftCharacter === '.') {
      const prevWordRange = document.getWordRangeAtPosition(
        genPosByShift(wordRange.start, -2)
      );
      prevWord = document.getText(prevWordRange);
    }
    const rawFile = document.getText();
    const processor = (raw: string, filePath?: string): Thenable<Location | null> => {
      const thriftParseResult = parse(raw);
      if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
        return Promise.resolve(null);
      }
      const astHelper = new ASTHelper(thriftParseResult, document);
      const wordNode = astHelper.findNodeByWord(word);
      const prevWordNode = astHelper.findNodeByWord(prevWord);
      const includeNodeList = astHelper.includeNodes;
      /**
       * If prev word is an enum define, jump to the enum member defined position.
       * e.g. Worker.ENGINEER -> jump to the ENGINEER defined line
       */
      if (prevWordNode && prevWordNode.type === 'EnumDefinition') {
        const enumNumber = prevWordNode.members.find(item => item.name.value === word);
        if (enumNumber) {
          return this.genLocation(enumNumber.name.loc, filePath);
        }
      }
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
      if (wordNode) return this.genLocation(wordNode.name.loc, filePath);
      const includeNode = includeNodeList.find(item => {
        return item.raw.indexOf(word) > -1;
      });
      if (includeNode) {
        const { raw, filePath } = includeNode;
        return processor(raw, filePath);
      }
      return Promise.resolve(null);
    };
    return processor(rawFile, document.fileName);
  }
}

export default ThriftDefineProvider;
