import {
  ThriftDocument,
  ThriftStatement,
  SyntaxType,
} from '@creditkarma/thrift-parser';

export type filterFnType = (item: ThriftStatement, index: number) => any;

export type GetReturnType<original extends Function> = 
  original extends (...x: any[]) => infer returnType ? returnType : never;

export const genZeroBasedNum = (num: number) => num - 1;

export const genASTHelper = (ast: ThriftDocument) =>
  <fn extends filterFnType>(originalFn: fn) => {
    const result = (ast.body.filter(originalFn) as GetReturnType<fn>[]);
    return result;
  };

export const wordNodeFilter = (word: string) =>
  (item: ThriftStatement, index: number) => {
    if (
      item.type !== SyntaxType.IncludeDefinition && 
      item.type !== SyntaxType.CppIncludeDefinition &&
      item.name.value === word
    ) {
      return item;
    }
  };

export const includeNodeFilter = () =>
  (item: ThriftStatement, index: number) => {
    if (
      item.type === SyntaxType.IncludeDefinition
    ) {
      return item;
    }
  };