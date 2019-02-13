'use strict';
import { languages, DocumentFilter, ExtensionContext } from 'vscode';

import ThriftDefineProvider from './DefineProvider';
// import { parse, ThriftDocument } from '@creditkarma/thrift-parser';

export function activate(context: ExtensionContext) {
  const langMode: DocumentFilter = { scheme: 'file', language: 'thrift' };
  console.log('Congratulations, your extension "thrift-syntax-support" is now active!');
  context.subscriptions.push(
    languages.registerDefinitionProvider(
      langMode,
      new ThriftDefineProvider()
    )
  );
  // languages.registerHoverProvider(
  //   { scheme: 'file', language: 'thrift' },
  //   {
  //     provideHover(document, position, token) {
  //       const rawFile = fs.readFileSync(document.fileName, { encoding: 'utf8' });
  //       console.log('position: ', position);
  //       console.log('token: ', token);
  //       const thriftAST = parse(rawFile);
  //       console.log(thriftAST);
  //       switch (thriftAST.type) {
  //         case 'ThriftDocument':
  //           break;
  //         case 'ThriftErrors':
  //           return;
  //         default:
  //           return new Hover('I am a hover!');
  //       }
  //     }
  // });
}