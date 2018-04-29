folder="$1"
if [ "a$folder" == "a" ]
then
echo "Usage: script [output folder]"
exit 1
fi
mkdir -p "$folder"
ts=`date +%s`

runDataSource() {
	node analyzer.js $1 $3 2>&1 | tee $2
}

runDataSource 'http://www.linuxelite.com.br/' "$folder/1-mal-$ts" 5000
runDataSource 'https://eenteslavoorsimon.be/' "$folder/2-mal-$ts" 5000
runDataSource 'https://news.google.com/news/?ned=us&gl=US&hl=en' "$folder/3-good-$ts" 5000
runDataSource https://www.youtube.com/watch?v=v_mOkUk5CDw "$folder/4-good-vid-$ts" 5000
runDataSource 'http://abcnews.go.com/US/pastor-church-attended-25000-steps-amid-misconduct-allegations/story?id=54383250' "$folder/5-good-ad-$ts" 5000
runDataSource 'http://bitcointicker.co/' "$folder/6-good-ui-$ts" 5000
runDataSource 'https://stackoverflow.com/questions/3216013/get-the-last-item-in-an-array' "$folder/7-good-$ts" 5000
runDataSource 'https://www.choosechicago.com/restaurants/' "$folder/8-good-$ts" 5000
runDataSource 'http://189.26.255.57:8081/' "$folder/9-mal-$ts" 5000
