'use strict';
import { languages, DocumentFilter, ExtensionContext } from 'vscode';

import ThriftDefineProvider from './DefineProvider';
import ThriftHoverProvider from './HoverProvider';
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
  context.subscriptions.push(
    languages.registerHoverProvider(
      langMode,
      new ThriftHoverProvider()
    )
  );
}