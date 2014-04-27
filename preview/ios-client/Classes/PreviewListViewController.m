

#import "PreviewListViewController.h"
#import "JSON.h"
#import "CSNotificationView.h"

@interface PreviewListViewController()
@property(nonatomic, assign) BOOL * isFirstAppear;
@property(nonatomic, assign) BOOL * loading;
@property(nonatomic, strong) NSMutableData * previewsData;
@end

@implementation PreviewListViewController

- (void)viewDidLoad
{
  [super viewDidLoad];
  self.title = @"Previews";
  self.isFirstAppear = YES;
  self.refreshControl = [[UIRefreshControl alloc]init];
  [self.refreshControl addTarget:self action:@selector(refresh) forControlEvents:UIControlEventValueChanged];
  self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemRefresh target:self action:@selector(trickRefresh)];
  
}

- (void)viewWillAppear:(BOOL)animated{
  if(self.isFirstAppear){
    self.isFirstAppear = NO;
      if(!self.loading){
        [self trickRefresh];
      }
  }
}

#pragma mark - Fetched results controller

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
  return self.previews.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  
  static NSString *CellIdentifier = @"Cell";
  
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:CellIdentifier];
  if (cell == nil)
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:CellIdentifier];
  cell.accessoryType = UITableViewCellAccessoryDisclosureIndicator;
  cell.textLabel.numberOfLines = 1;
  NSString * urlString = [self.previews objectAtIndex:indexPath.row];
  NSArray *parts = [urlString componentsSeparatedByString:@"/"];
  NSString *filename = [NSString stringWithFormat:@"%d. %@",indexPath.row+1, [parts objectAtIndex:[parts count]-1]];
  cell.textLabel.text = filename;
  return cell;
}

//- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)indexPath
//{
//  return 50;
//}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
  DetailViewController * detailViewController = [[DetailViewController alloc] initWithNibName:nil bundle:nil];
  detailViewController.previews = self.previews;
  detailViewController.startIndex = indexPath.row;
  [self.navigationController pushViewController:detailViewController animated:YES];
}

#pragma mark - API Method

- (void)trickRefresh{
  if(!self.loading && self.server){
    [self.refreshControl beginRefreshing];
    [self refresh];
    if (self.tableView.contentOffset.y+self.tableView.contentInset.top > -self.refreshControl.frame.size.height) {
      [UIView animateWithDuration:0.25 delay:0 options:UIViewAnimationOptionBeginFromCurrentState animations:^(void){
        self.tableView.contentOffset = CGPointMake(0, self.tableView.contentOffset.y-self.refreshControl.frame.size.height);
      } completion:^(BOOL finished){
      }];
    }
  }
}

- (void)refresh{
    if(!self.loading && self.server){
    self.loading = YES;
    NSURLRequest *request = [NSURLRequest requestWithURL:[NSURL URLWithString:self.server.url]];
    NSURLConnection* topAppsConnection = [[NSURLConnection alloc] initWithRequest:request delegate:self] ;
    [topAppsConnection start];
    }
}

- (void)finishLoad{
  self.loading = NO;
  [self.refreshControl endRefreshing];
  [self.tableView reloadData];
}

- (void)cancleLoadPreviews:(NSError *)error{
  self.previews = @[];
  [self finishLoad];
  [CSNotificationView showInViewController:self.navigationController
                                     style:CSNotificationViewStyleError
                                   message:error.userInfo[@"NSLocalizedDescription"]];
  
}

- (void)connection:(NSURLConnection *)connection didReceiveResponse:(NSURLResponse *)response
{
  NSInteger status = [(NSHTTPURLResponse*)response statusCode];
  if (status != 200){
    NSError * error = [NSError errorWithDomain:[NSString stringWithFormat:@"Response error"] code:status userInfo:@{@"NSLocalizedDescription": [NSString stringWithFormat:@"Response code: %d",status]}];
    [self cancleLoadPreviews:error];
  }
  
}

- (void)connection:(NSURLConnection *)connection didReceiveData:(NSData *)data
{
  if(!self.previewsData){
    self.previewsData = [[NSMutableData alloc] init];
  }
  [self.previewsData appendData:data];
}

- (void)connection:(NSURLConnection *)connection didFailWithError:(NSError *)error
{
  [self cancleLoadPreviews:error];
}

- (void)connectionDidFinishLoading:(NSURLConnection *)connection
{
  NSString * previewsDataString = [[NSString alloc] initWithData:self.previewsData encoding:NSUTF8StringEncoding];
  self.previewsData = nil;
  id jsonValue =  [previewsDataString JSONValue];
  if([jsonValue isKindOfClass:[NSArray class]]){
    self.previews = jsonValue;
  }
  
  [self finishLoad];

}
@end

