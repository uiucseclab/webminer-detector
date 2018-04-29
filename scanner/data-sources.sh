folder="$1"
if [ "a$folder" == "a" ]
then
echo "Usage: script [output folder]"
exit 1
fi
mkdir -p "$folder"
ts=`date +%s`
npm start 'http://www.linuxelite.com.br/' "$folder/1-mal-$ts" 5000
npm start 'https://eenteslavoorsimon.be/' "$folder/2-mal-$ts" 5000
npm start 'https://news.google.com/news/?ned=us&gl=US&hl=en' "$folder/3-good-$ts" 5000
npm start https://www.youtube.com/watch?v=v_mOkUk5CDw "$folder/4-good-vid-$ts" 5000
npm start 'http://abcnews.go.com/US/pastor-church-attended-25000-steps-amid-misconduct-allegations/story?id=54383250' "$folder/5-good-ad-$ts" 5000
npm start 'http://bitcointicker.co/' "$folder/6-good-ui-$ts" 5000
npm start 'https://stackoverflow.com/questions/3216013/get-the-last-item-in-an-array' "$folder/7-good-$ts" 5000
npm start 'https://www.choosechicago.com/restaurants/' "$folder/8-good-$ts" 5000
npm start 'http://189.26.255.57:8081/' "$folder/9-mal-$ts" 5000
