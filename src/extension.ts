import { languages, DocumentFilter, ExtensionContext } from 'vscode';

import ThriftDefineProvider from './DefineProvider';
import ThriftHoverProvider from './HoverProvider';
import ThriftCompletionItemProvider from './CompletionProvider';
import ThriftSymbolProvider from './SymbolProvider';

export function activate(context: ExtensionContext): void {
  const langMode: DocumentFilter = { scheme: 'file', language: 'thrift' };
  
  console.log('"thrift-syntax-support" is now active!');

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
  
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      langMode,
      new ThriftCompletionItemProvider(),
    )
  );

  context.subscriptions.push(
    languages.registerDocumentSymbolProvider(
      langMode,
      new ThriftSymbolProvider()
    )
  );
}