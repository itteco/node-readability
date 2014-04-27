//
//  AddServerViewController.h
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-26.
//
//

#import <UIKit/UIKit.h>
#import "BZGFormField.h"
#import "Server.h"
@protocol AddServerViewControllerDelegate;

@interface AddServerViewController : UIViewController<BZGFormFieldDelegate>
@property (weak, nonatomic) IBOutlet BZGFormField * serverNameField;
@property (weak, nonatomic) IBOutlet BZGFormField * serverUrlFiled;
@property (nonatomic, weak) id <AddServerViewControllerDelegate> delegate;
@property (nonatomic, strong) NSManagedObjectContext *managedObjectContext;
@property (nonatomic, strong) Server * server;
@end

@protocol AddServerViewControllerDelegate <NSObject>

- (void)addServerViewController:(AddServerViewController *)controller server:(Server *)server didFinishWithSave:(BOOL)save;

@end