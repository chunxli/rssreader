// This file was automatically generated by gyb
// DO NOT EDIT!
// Compiled from ../../Maps/iOS/Shared/User Generated Content/Data Model/Reviewed Place Storage/database/CachedReviewedPlace.gyb.config

#import <GeoServices/GEOSQLiteDB.h>

static const char * CreateTable_reviewedplace =
"CREATE TABLE IF NOT EXISTS reviewedplace ("
"    muid INT NOT NULL,"
"    recommendstate INT NOT NULL,"
"    photosadded INT NOT NULL,"
"    UNIQUE(muid)"
"    );";


static NSString *const SetReviewedPlaceKey = @"SetReviewedPlace";
static const char * const SetReviewedPlaceSQL =
"INSERT OR REPLACE INTO reviewedplace"
"    (muid, recommendstate, photosadded)"
"    VALUES (@muid, @recommendstate, @photosadded);";

static NSString *const FindReviewedPlaceKey = @"FindReviewedPlace";
static const char * const FindReviewedPlaceSQL =
"SELECT muid, recommendstate, photosadded"
"    FROM reviewedplace"
"    WHERE muid = @muid"
"    LIMIT 1"
";";

static NSString *const RemoveReviewedPlaceKey = @"RemoveReviewedPlace";
static const char * const RemoveReviewedPlaceSQL =
"DELETE FROM reviewedplace"
"    WHERE muid = @muid"
"    LIMIT 1"
";";

static NSString *const DropReviewedPlaceEntriesKey = @"DropReviewedPlaceEntries";
static const char * const DropReviewedPlaceEntriesSQL =
"DROP TABLE reviewedplace;";



static BOOL setupGYBStatements(GEOSQLiteDB *db, os_log_t log, const BOOL withDrop)
{

    GEOGuardReturnValue([db createTable:CreateTable_reviewedplace withDrop:withDrop ? "DROP TABLE reviewedplace" : NULL], NO);

    GEOGuardReturnValue([db prepareStatement:SetReviewedPlaceSQL forKey:SetReviewedPlaceKey], NO);
    GEOGuardReturnValue([db prepareStatement:FindReviewedPlaceSQL forKey:FindReviewedPlaceKey], NO);
    GEOGuardReturnValue([db prepareStatement:RemoveReviewedPlaceSQL forKey:RemoveReviewedPlaceKey], NO);
    GEOGuardReturnValue([db prepareStatement:DropReviewedPlaceEntriesSQL forKey:DropReviewedPlaceEntriesKey], NO);

    return YES;
}

static BOOL SetReviewedPlace(GEOSQLiteDB *db, NSError **errorOut, uint64_t muidIn, int32_t recommendstateIn, uint32_t photosaddedIn)
{
    __block NSError *error;
    BOOL const result = [db executeStatement:SetReviewedPlaceKey statementBlock:^BOOL(sqlite3_stmt * _Nonnull stmt) {
        GEOGuardReturnValue([db bindInt64Parameter:"@muid" toValue:(int64_t)muidIn inStatement:stmt error:&error], NO);
        GEOGuardReturnValue([db bindIntParameter:"@recommendstate" toValue:(int)recommendstateIn inStatement:stmt error:&error], NO);
        GEOGuardReturnValue([db bindIntParameter:"@photosadded" toValue:(int)photosaddedIn inStatement:stmt error:&error], NO);
        return YES;
    }];
    if (error && errorOut) {
        *errorOut = error;
    }
    return result;
}

static BOOL FindReviewedPlace(GEOSQLiteDB *db, NSError **errorOut, uint64_t muidIn, BOOL(^NS_NOESCAPE rowBlock)(uint64_t muid, int32_t recommendstate, uint32_t photosadded))
{
    __block NSError *error = nil;
    BOOL const result = [db statementForKey:FindReviewedPlaceKey statementBlock:^BOOL(sqlite3_stmt * _Nonnull stmt) {
        GEOGuardReturnValue([db bindInt64Parameter:"@muid" toValue:(int64_t)muidIn inStatement:stmt error:&error], NO);
        int rc = sqlite3_step(stmt);
        while (SQLITE_ROW == rc) {
            uint64_t muidOut = (uint64_t)[db int64ForColumn:0 inStatment:stmt];
            int32_t recommendstateOut = (int32_t)[db intForColumn:1 inStatment:stmt];
            uint32_t photosaddedOut = (uint32_t)[db intForColumn:2 inStatment:stmt];
            if (!rowBlock(muidOut, recommendstateOut, photosaddedOut)) {
                rc = SQLITE_DONE;
                break;
            }
            rc = sqlite3_step(stmt);
        }
        if (SQLITE_DONE != rc) { // it's not an error if we got no results or stopped intentionally
            [db reportSQLiteErrorCode:rc method:@"step" error:&error];
        }
        return (SQLITE_DONE == rc);
    }];
    if (error && errorOut) {
        *errorOut = error;
    }
    return result;
}

static BOOL RemoveReviewedPlace(GEOSQLiteDB *db, NSError **errorOut, uint64_t muidIn)
{
    __block NSError *error;
    BOOL const result = [db executeStatement:RemoveReviewedPlaceKey statementBlock:^BOOL(sqlite3_stmt * _Nonnull stmt) {
        GEOGuardReturnValue([db bindInt64Parameter:"@muid" toValue:(int64_t)muidIn inStatement:stmt error:&error], NO);
        return YES;
    }];
    if (error && errorOut) {
        *errorOut = error;
    }
    return result;
}

