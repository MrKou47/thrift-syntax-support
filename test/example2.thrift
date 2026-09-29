namespace cpp thrift.example
namespace java thrift.example

enum TweetType2 {
    TWEET,
    RETWEET = 2,
    DM = 0xa,
    REPLY
}

struct Location2 {
    1: required double latitude;
    2: required double longitude;
}