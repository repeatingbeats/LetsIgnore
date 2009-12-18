#! /bin/bash

rm *.xpi

EXTENSION=letsignore
SRCDIR=`pwd`
mkdir build

# compile XPCOM
cd $EXTENSION/components
xpidl -m typelib \
      -I $SONGBIRD/dependencies/macosx-i686/mozilla/release/frozen/idl/ \
      -I ~/Documents/professional/tools/gecko/xulrunner-sdk/idl/ \
       rbILetsignoreManager.idl
mkdir -p $SRCDIR/build/components
cp *.xpt $SRCDIR/build/components
cp *.js $SRCDIR/build/components

# build JAR for chrome
cd $SRCDIR/$EXTENSION
pwd
mkdir -p jar/chrome
rsync -rv --exclude "*.svn" --exclude "*.swp" \
          --exclude "*.git" --exclude "*.DS_Store" \
          chrome jar
cd jar/chrome
pwd
zip -r $EXTENSION.jar .
mkdir -p $SRCDIR/build/chrome
cp $EXTENSION.jar $SRCDIR/build/chrome
cd $SRCDIR
rm -rf $EXTENSION/jar

# copy everything else
cp $EXTENSION/install.* build
cp $EXTENSION/*.manifest build
mkdir -p build/defaults/preferences
cd $EXTENSION/defaults/preferences
cp *.* $SRCDIR/build/defaults/preferences
cd $SRCDIR

# build the XPI
cd build
rm -f .DS_Store
zip -r $EXTENSION.xpi *
mv $EXTENSION.xpi ../
cd ..
rm -rf build

