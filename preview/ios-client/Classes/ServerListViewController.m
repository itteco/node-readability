//
//  ServerListViewController.m
//  ReadabilityPreveiw
//
//  Created by Joiningss on 14-4-26.
//
//

#import "ServerListViewController.h"
#import "AppDelegate.h"
#import "Server.h"
#import "AddServerViewController.h"
#import "PreviewListViewController.h"
#import "ScaneViewController.h"
@interface ServerListViewController ()<AddServerViewControllerDelegate>
@property(nonatomic, strong) NSManagedObjectContext * managedObjectContext;
@property(nonatomic, strong) NSFetchedResultsController *fetchedResultsController;
@property(nonatomic, strong) UIBarButtonItem *rightBarButtonItem;
@property(nonatomic, strong) Server * selectedServer;
@end

@implementation ServerListViewController
static NSString *CellIdentifier = @"Cell";
- (void)viewDidLoad
{
  [super viewDidLoad];
  [self.tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:CellIdentifier];
  self.managedObjectContext = ((AppDelegate *)[[UIApplication sharedApplication] delegate]).managedObjectContext;
  UIBarButtonItem * add = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemAdd target:self action:@selector(showAddAlert)];
  UIBarButtonItem * scan = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemCamera target:self action:@selector(showScan)];
  self.navigationItem.rightBarButtonItems = @[scan,add];
  self.navigationItem.leftBarButtonItem = self.editButtonItem;
  self.title = @"Servers";
  NSError * error;
  if(![self.fetchedResultsController performFetch:&error]){
    NSLog(@"Unresolved error: %@, %@",error,[error userInfo]);
    abort();
  }
}

- (void)viewWillAppear:(BOOL)animated{
  [super viewWillAppear:animated];
  [self.tableView reloadData];
}
- (void)didReceiveMemoryWarning
{
  [super didReceiveMemoryWarning];
  // Dispose of any resources that can be recreated.
}

#pragma mark - Table view data source

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
  
  return [[self.fetchedResultsController sections] count];
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
  id <NSFetchedResultsSectionInfo> sectionInfo = [[self.fetchedResultsController sections] objectAtIndex:section];
  return [sectionInfo numberOfObjects];
}
// Customize the appearance of table view cells.
- (void)configureCell:(UITableViewCell *)cell atIndexPath:(NSIndexPath *)indexPath {
  Server * server = [self.fetchedResultsController objectAtIndexPath:indexPath];
  cell.textLabel.text = server.url;
  BOOL isSelected = NO;
  if(self.selectedServer && [self.selectedServer.creatDate isEqualToDate:server.creatDate]){
    isSelected = YES;
  }
  cell.accessoryType = isSelected?UITableViewCellAccessoryCheckmark:UITableViewCellAccessoryDisclosureIndicator;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:CellIdentifier forIndexPath:indexPath];
  [self configureCell:cell atIndexPath:indexPath];
  return cell;
}
- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section {
  // Display the authors' names as section headings.
  return [[[self.fetchedResultsController sections] objectAtIndex:section] name];
}
#pragma mark - Table view editing

- (void)tableView:(UITableView *)tableView commitEditingStyle:(UITableViewCellEditingStyle)editingStyle forRowAtIndexPath:(NSIndexPath *)indexPath {
  
  if (editingStyle == UITableViewCellEditingStyleDelete) {
    
    // Delete the managed object.
    NSManagedObjectContext *context = [self.fetchedResultsController managedObjectContext];
    [context deleteObject:[self.fetchedResultsController objectAtIndexPath:indexPath]];
    
    NSError *error;
    if (![context save:&error]) {
      /*
       Replace this implementation with code to handle the error appropriately.
       
       abort() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
       */
      NSLog(@"Unresolved error %@, %@", error, [error userInfo]);
      abort();
    }
  }
}

- (BOOL)tableView:(UITableView *)tableView canMoveRowAtIndexPath:(NSIndexPath *)indexPath {
  // The table view should not be re-orderable.
  return NO;
}


- (void)setEditing:(BOOL)editing animated:(BOOL)animated {
  
  [super setEditing:editing animated:animated];
  
  if (editing) {
    self.rightBarButtonItem = self.navigationItem.rightBarButtonItem;
    self.navigationItem.rightBarButtonItem = nil;
  }
  else {
    self.navigationItem.rightBarButtonItem = self.rightBarButtonItem;
    self.rightBarButtonItem = nil;
  }
}


#pragma mark - Fetched results controller

/*
 Returns the fetched results controller. Creates and configures the controller if necessary.
 */
- (NSFetchedResultsController *)fetchedResultsController {
  
  if (_fetchedResultsController != nil) {
    return _fetchedResultsController;
  }
  
  // Create and configure a fetch request with the Book entity.
  NSFetchRequest *fetchRequest = [[NSFetchRequest alloc] init];
  NSEntityDescription *entity = [NSEntityDescription entityForName:@"Server" inManagedObjectContext:self.managedObjectContext];
  [fetchRequest setEntity:entity];
  
  // Create the sort descriptors array.
  
  NSSortDescriptor *creatDateDescriptor = [[NSSortDescriptor alloc] initWithKey:@"creatDate" ascending:YES];
  NSArray *sortDescriptors = @[creatDateDescriptor];
  [fetchRequest setSortDescriptors:sortDescriptors];
  
  // Create and initialize the fetch results controller.
  _fetchedResultsController = [[NSFetchedResultsController alloc] initWithFetchRequest:fetchRequest managedObjectContext:self.managedObjectContext sectionNameKeyPath:@"name" cacheName:@"Root"];
  _fetchedResultsController.delegate = self;
  
  return _fetchedResultsController;
}


/*
 NSFetchedResultsController delegate methods to respond to additions, removals and so on.
 */
- (void)controllerWillChangeContent:(NSFetchedResultsController *)controller {
  
  // The fetch controller is about to start sending change notifications, so prepare the table view for updates.
  [self.tableView beginUpdates];
}


- (void)controller:(NSFetchedResultsController *)controller didChangeObject:(id)anObject atIndexPath:(NSIndexPath *)indexPath forChangeType:(NSFetchedResultsChangeType)type newIndexPath:(NSIndexPath *)newIndexPath {
  
  UITableView *tableView = self.tableView;
  
  switch(type) {
      
    case NSFetchedResultsChangeInsert:
      [tableView insertRowsAtIndexPaths:@[newIndexPath] withRowAnimation:UITableViewRowAnimationAutomatic];
      break;
      
    case NSFetchedResultsChangeDelete:
      [tableView deleteRowsAtIndexPaths:@[indexPath] withRowAnimation:UITableViewRowAnimationAutomatic];
      break;
      
    case NSFetchedResultsChangeUpdate:
      [self configureCell:[tableView cellForRowAtIndexPath:indexPath] atIndexPath:indexPath];
      break;
      
    case NSFetchedResultsChangeMove:
      [tableView deleteRowsAtIndexPaths:@[indexPath] withRowAnimation:UITableViewRowAnimationAutomatic];
      [tableView insertRowsAtIndexPaths:@[newIndexPath] withRowAnimation:UITableViewRowAnimationAutomatic];
      break;
  }
}


- (void)controller:(NSFetchedResultsController *)controller didChangeSection:(id <NSFetchedResultsSectionInfo>)sectionInfo atIndex:(NSUInteger)sectionIndex forChangeType:(NSFetchedResultsChangeType)type
{
  switch(type) {
      
    case NSFetchedResultsChangeInsert:
      [self.tableView insertSections:[NSIndexSet indexSetWithIndex:sectionIndex] withRowAnimation:UITableViewRowAnimationAutomatic];
      break;
      
    case NSFetchedResultsChangeDelete:
      [self.tableView deleteSections:[NSIndexSet indexSetWithIndex:sectionIndex] withRowAnimation:UITableViewRowAnimationAutomatic];
      break;
  }
}

- (void)controllerDidChangeContent:(NSFetchedResultsController *)controller {
  
  // The fetch controller has sent all current change notifications, so tell the table view to process all updates.
  [self.tableView endUpdates];
}

#pragma mark - Add Server 

- (void)showAddAlert{
  NSManagedObjectContext *addingContext = [[NSManagedObjectContext alloc] initWithConcurrencyType:NSMainQueueConcurrencyType];
  [addingContext setParentContext:[self.fetchedResultsController managedObjectContext]];
  Server * newServer = [NSEntityDescription insertNewObjectForEntityForName:@"Server" inManagedObjectContext:addingContext];
  AddServerViewController * avc = [[AddServerViewController alloc] init];
  avc.delegate = self;
  avc.managedObjectContext = addingContext;
  avc.server = newServer;
  [self.navigationController pushViewController:avc animated:YES];
}
- (void)showScan{
  ScaneViewController * scv = [[ScaneViewController alloc] init];
  [self.navigationController presentViewController:scv animated:YES completion:nil];
}
- (void)addServerViewController:(AddServerViewController *)controller server:(Server *)server didFinishWithSave:(BOOL)save{
  if (save) {
    /*
     The new book is associated with the add controller's managed object context.
     This means that any edits that are made don't affect the application's main managed object context -- it's a way of keeping disjoint edits in a separate scratchpad. Saving changes to that context, though, only push changes to the fetched results controller's context. To save the changes to the persistent store, you have to save the fetch results controller's context as well.
     */
    NSError *error;
    NSManagedObjectContext *addingManagedObjectContext = [controller managedObjectContext];
    if (![addingManagedObjectContext save:&error]) {
      /*
       Replace this implementation with code to handle the error appropriately.
       
       abort() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
       */
      NSLog(@"Unresolved error %@, %@", error, [error userInfo]);
      abort();
    }
    
    if (![[self.fetchedResultsController managedObjectContext] save:&error]) {
      /*
       Replace this implementation with code to handle the error appropriately.
       
       abort() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
       */
      NSLog(@"Unresolved error %@, %@", error, [error userInfo]);
      abort();
    }
  }
  [controller.navigationController popViewControllerAnimated:YES];
}




 #pragma mark - Table view delegate
 
 // In a xib-based application, navigation from a table can be handled in -tableView:didSelectRowAtIndexPath:
 - (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
 {
   self.selectedServer = [self.fetchedResultsController objectAtIndexPath:indexPath];
   PreviewListViewController * pcv = [[PreviewListViewController alloc] init];
   pcv.server = self.selectedServer;
   [self.navigationController pushViewController:pcv animated:YES];
 }


@end
