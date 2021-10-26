#!/bin/bash -e

gyb="python ../../../../../../../GeoServices/tools/gyb.py"

function gybit()
{
    config="$1"
    echo "Generating ${config}_gyb.m"
    $gyb --line-directive '' ../../../../../../../GeoServices/database/SQLiteDB.m.gyb -DconfigFile=../../Maps/iOS/Shared/User\ Generated\ Content/Data\ Model/Reviewed\ Place\ Storage/database/${config} -o ${config}_gyb.m
}
 
cd $(dirname $0)

gybit CachedReviewedPlace

