//
//  ScaneViewController.h
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-28.
//
//

#import <UIKit/UIKit.h>
@protocol ScaneViewControllerDelegate;

@interface ScaneViewController : UIViewController
@property(nonatomic, assign) id<ScaneViewControllerDelegate> delegate;

@end

@protocol ScaneViewControllerDelegate <NSObject>

- (void)onScaned:(ScaneViewController *)scaneViewController scanedInfo:(NSDictionary *)scanedInfo;

@end