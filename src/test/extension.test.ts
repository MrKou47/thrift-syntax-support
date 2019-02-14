import * as assert from 'assert';

import { genZeroBasedNum } from '../utils';

// Defines a Mocha test suite to group tests of similar kind together
suite("Util tests", function () {

  // Defines a Mocha unit test
  test("genZeroBasedNum", function () {
    assert.equal(genZeroBasedNum(2), 1);
  });
});