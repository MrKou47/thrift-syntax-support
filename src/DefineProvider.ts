import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri } from 'vscode';
import {
  parse,
  SyntaxType,
  TextLocation,
} from '@creditkarma/thrift-parser';
import { genRange, ASTHelper } from './utils';

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
    const rawFile = document.getText();
    const processor = (raw: string, filePath?: string): Thenable<Location | null> => {
      const thriftParseResult = parse(raw);
      console.log(thriftParseResult);
      if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
        return Promise.resolve(null);
      }
      const astHelper = new ASTHelper(thriftParseResult, document);
      const wordNode = astHelper.findNodeByWord(word);
      const includeNodeList = astHelper.includeNodes;
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
    return new Promise(() => {});
  }
}

export default ThriftDefineProvider;
