//
//  Server.h
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-27.
//
//

#import <Foundation/Foundation.h>
#import <CoreData/CoreData.h>


@interface Server : NSManagedObject

@property (nonatomic, retain) NSDate * creatDate;
@property (nonatomic, retain) NSString * name;
@property (nonatomic, retain) NSString * url;

@end
