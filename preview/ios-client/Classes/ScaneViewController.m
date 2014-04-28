//
//  ScaneViewController.m
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-28.
//
//

#import "ScaneViewController.h"
#import "CSNotificationView.h"
#import "ZXingObjC.h"
#import "Server.h"
#import "JSON.h"
@interface ScaneViewController ()<ZXCaptureDelegate>{
  BOOL isParsering;
}
@property (nonatomic, strong) ZXCapture *capture;
@property (nonatomic, weak) IBOutlet UIView *scanRectView;
@property (nonatomic, weak) IBOutlet UIButton *cancleButton;
@end

@implementation ScaneViewController

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
    self.capture = [[ZXCapture alloc] init];
    self.capture.camera = self.capture.back;
    self.capture.focusMode = AVCaptureFocusModeContinuousAutoFocus;
    self.capture.rotation = 90.0f;
    self.capture.layer.frame = self.view.bounds;
    [self.view.layer addSublayer:self.capture.layer];
    [self.view bringSubviewToFront:self.scanRectView];
    [self.view bringSubviewToFront:self.cancleButton];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  
  self.capture.delegate = self;
  self.capture.layer.frame = self.view.bounds;
  
  CGAffineTransform captureSizeTransform = CGAffineTransformMakeScale(320 / self.view.frame.size.width, 480 / self.view.frame.size.height);
  self.capture.scanRect = CGRectApplyAffineTransform(self.scanRectView.frame, captureSizeTransform);
}

- (BOOL)shouldAutorotateToInterfaceOrientation:(UIInterfaceOrientation)toInterfaceOrientation {
  return toInterfaceOrientation == UIInterfaceOrientationPortrait;
}
#pragma mark - ZXCaptureDelegate Methods

- (void)captureResult:(ZXCapture *)capture result:(ZXResult *)result {
  if (!result) return;
  if(!isParsering){
    isParsering = YES;
    NSString * display = [NSString stringWithFormat:@"Scanned Contents:\n%@", result.text];
    NSLog(@"%@",display);
    id jsonDic = [result.text JSONValue];
    if(jsonDic && [jsonDic isKindOfClass:[NSDictionary class]] && [jsonDic valueForKey:@"name"] && [jsonDic valueForKey:@"url"]){
      // Vibrate
      if(self.delegate && [self.delegate respondsToSelector:@selector(onScaned:scanedInfo:)]){
        [self.delegate onScaned:self scanedInfo:jsonDic];
      }
      AudioServicesPlaySystemSound(kSystemSoundID_Vibrate);
    }else{
      [CSNotificationView showInViewController:self
                                         style:CSNotificationViewStyleError
                                       message:@"QRCode Error"];
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, kCSNotificationViewDefaultShowDuration * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        isParsering = NO;
      });
    }
  }
}

- (IBAction)cancle:(id)sender{
  [self.capture stop];
  self.capture = nil;
  [self dismissViewControllerAnimated:YES completion:nil];
}

@end
