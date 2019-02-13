import {
  ThriftDocument,
  ThriftStatement,
  SyntaxType,
} from '@creditkarma/thrift-parser';

// type noop = (item: ThriftStatement, index: number) => any;

export const genZeroBasedNum = (num: number) => num - 1;

const astFilter = (word: string) => (item: ThriftStatement, index: number) => {
  if (
    item.type !== SyntaxType.IncludeDefinition && 
    item.type !== SyntaxType.CppIncludeDefinition &&
    item.name.value === word
  ) {
    return item;
  }
};

type filteredASTNodeType = ReturnType<ReturnType<typeof astFilter>>;

export const wordNodeFinder = (ast: ThriftDocument, word: string): filteredASTNodeType => {
  try {
    const currentASTNodeList = ast.body.filter(astFilter(word)) as filteredASTNodeType[];
    if (currentASTNodeList.length) {
      const currentASTNode = currentASTNodeList[0];
      return currentASTNode;
    }
  } catch (e) {
    return e;
  }
};


