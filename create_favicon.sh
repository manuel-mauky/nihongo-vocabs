#!/bin/sh
mkdir ./tmp

inkscape -z -e ./tmp/favicon.png -w 128 -h 128 favicon.svg

convert ./tmp/favicon.png -resize 16x16 ./tmp/16.png
convert ./tmp/favicon.png -resize 32x32 ./tmp/32.png
convert ./tmp/favicon.png -resize 64x64 ./tmp/64.png
convert ./tmp/favicon.png -resize 128x128 ./tmp/128.png

convert ./tmp/16.png ./tmp/32.png ./tmp/64.png ./tmp/128.png ./public/favicon.ico

rm -r ./tmp
