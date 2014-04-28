//
//  AddServerViewController.m
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-26.
//
//

#import "AddServerViewController.h"

@interface AddServerViewController (){
  BOOL firstAppear;
  BOOL nameFiledValid;
  BOOL urlFiledValid;
}
@property(nonatomic,strong) UIBarButtonItem * saveBarButton;
@end

@implementation AddServerViewController

- (id)initWithNibName:(NSString *)nibNameOrNil bundle:(NSBundle *)nibBundleOrNil
{
  self = [super initWithNibName:nibNameOrNil bundle:nibBundleOrNil];
  if (self) {
    // Custom initialization
  }
  return self;
}

- (void)viewDidLoad
{
  [super viewDidLoad];
  firstAppear = YES;
  self.title = @"Add Server";
  self.navigationItem.backBarButtonItem.title = @"back";
  self.saveBarButton = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemSave target:self action:@selector(save)];
  [self.saveBarButton setEnabled:NO];
  self.navigationItem.rightBarButtonItem = self.saveBarButton;
  
  
  self.serverNameField.textField.placeholder = @"Name";
  [self.serverNameField setAsyncTextValidationBlock:^BOOL(BZGFormField *field, NSString *text) {
      
    if(text.length>0){
      nameFiledValid = YES;

    }else{
      field.alertView.title = @"Server name couldn't be empty";
      nameFiledValid = NO;
    }
      dispatch_async(dispatch_get_main_queue(), ^{
          [self textFileChange];
      });
    return nameFiledValid;
  }];
  self.serverNameField.delegate = self;
  self.serverUrlFiled.textField.placeholder = @"Url";
  [self.serverUrlFiled setAsyncTextValidationBlock:^BOOL(BZGFormField *field, NSString *text) {
    urlFiledValid = YES;
      dispatch_async(dispatch_get_main_queue(), ^{
          [self textFileChange];
      });
    
    return urlFiledValid;
  }];
  self.serverUrlFiled.delegate = self;
}

- (void)viewWillAppear:(BOOL)animated{
  [super viewWillAppear:animated];
  if(firstAppear){
    firstAppear = NO;
    [self.serverNameField.textField becomeFirstResponder];
  }
}

- (void)textFileChange{
  if(nameFiledValid && urlFiledValid){
    [self.navigationItem.rightBarButtonItem setEnabled:YES];
  }else{
    [self.navigationItem.rightBarButtonItem  setEnabled:NO];
  }
}

- (void)save{
  if(self.delegate && [self.delegate respondsToSelector:@selector(addServerViewController:server:didFinishWithSave:)]){
    if(self.server){
      self.server.name = self.serverNameField.textField.text;
      self.server.url = [NSString stringWithFormat:@"%@/getPreviewUrls",self.serverUrlFiled.textField.text];;
      self.server.creatDate = [NSDate date];
    }
    [self.delegate addServerViewController:self server:self.server didFinishWithSave:YES];
  }
}

@end
