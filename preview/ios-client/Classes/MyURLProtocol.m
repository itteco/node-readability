//
//  MyURLProtocol.m
//  NSURLProtocolExample
//
//  Created by Rocir Marcos Leite Santiago on 11/29/13.
//  Copyright (c) 2013 Rocir Santiago. All rights reserved.
//

#import "MyURLProtocol.h"

static NSString * const MyURLProtocolHandledKey = @"MyURLProtocolHandledKey";

@interface MyURLProtocol () <NSURLConnectionDelegate>

@property (nonatomic, strong) NSURLConnection *connection;
@property (nonatomic, strong) NSMutableData *mutableData;
@property (nonatomic, strong) NSURLResponse *response;

@end

@implementation MyURLProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest *)request {
  if([request.allHTTPHeaderFields valueForKey:@"Referer"] && [request.URL.absoluteString rangeOfString:@"http://tankr.net"].location != NSNotFound ){
    if ([NSURLProtocol propertyForKey:MyURLProtocolHandledKey inRequest:request]) {
      return NO;
    }else{
      return YES;
    }
  }else{
    return NO;
  }

}

+ (NSURLRequest *) canonicalRequestForRequest:(NSURLRequest *)request {
    return request;
}

- (void) startLoading {
  
    NSMutableURLRequest *newRequest = [self.request mutableCopy];
    [NSURLProtocol setProperty:@YES forKey:MyURLProtocolHandledKey inRequest:newRequest];
    if([newRequest.URL.absoluteString rangeOfString:@"http://tankr.net"].location != NSNotFound){
        [newRequest setValue:@"http://tankr.net" forHTTPHeaderField:@"Referer"];
    }
    self.connection = [NSURLConnection connectionWithRequest:newRequest delegate:self];
    
}

- (void) stopLoading {
    
    [self.connection cancel];
    self.mutableData = nil;
    
}

#pragma mark - NSURLConnectionDelegate

- (void) connection:(NSURLConnection *)connection didReceiveResponse:(NSURLResponse *)response {
    [self.client URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    
    self.response = response;
    self.mutableData = [[NSMutableData alloc] init];
}

- (void) connection:(NSURLConnection *)connection didReceiveData:(NSData *)data {
    [self.client URLProtocol:self didLoadData:data];
    
    [self.mutableData appendData:data];
}

- (void) connectionDidFinishLoading:(NSURLConnection *)connection {
    [self.client URLProtocolDidFinishLoading:self];
    
    // [self saveCachedResponse];
}

- (void)connection:(NSURLConnection *)connection didFailWithError:(NSError *)error {
    [self.client URLProtocol:self didFailWithError:error];
}

@end
