import { TextDocument, CancellationToken, SymbolInformation, DocumentSymbolProvider,  SymbolKind } from 'vscode';
import {
  parse,
  SyntaxType,
  IncludeDefinition,
  ThriftStatement,
  CppIncludeDefinition,
} from '@creditkarma/thrift-parser';
import { ASTHelper } from './utils';

class ThriftSymbolProvider implements DocumentSymbolProvider {
  getKind(syntaxType: SyntaxType): SymbolKind {
    switch (syntaxType) {

    case SyntaxType.StructDefinition:
      return SymbolKind.Interface;
    case SyntaxType.UnionDefinition:
      return SymbolKind.Class;
    case SyntaxType.ExceptionDefinition:
      return SymbolKind.Interface;
    case SyntaxType.ServiceDefinition:
      return SymbolKind.Class;
    case SyntaxType.EnumDefinition:
      return SymbolKind.Enum;
    case SyntaxType.ConstDefinition:
      return SymbolKind.Constant;
    case SyntaxType.TypedefDefinition:
      return SymbolKind.TypeParameter;
    case SyntaxType.IncludeDefinition:
      return SymbolKind.Module;
    case SyntaxType.CppIncludeDefinition:
      return SymbolKind.Module;
      break;
    }
  }

  public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {

    const rawFile = document.getText();
    const thriftParseResult = parse(rawFile);

    if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
      return Promise.resolve([]);
    }

    const astHelper = new ASTHelper(thriftParseResult, document, document.fileName);

    const result: SymbolInformation[] = [];

    for (let index = 0; index < astHelper.ast.body.length; index++) {
      const element = astHelper.ast.body[index];

      if (element.type === SyntaxType.IncludeDefinition) {
        continue;
      }

      const symbol = {
        name: (element as Exclude<ThriftStatement, IncludeDefinition | CppIncludeDefinition>).name.value,
        kind: this.getKind(element.type),
        containerName: '',
        location: astHelper.genLocation(element.loc),
      };

      result.push(symbol);
      
    }

    return new Promise((resolve) => {
      resolve(result);
    });
  }
}

export default ThriftSymbolProvider;
