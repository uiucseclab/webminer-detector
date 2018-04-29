folder="$1"
if [ "a$folder" == "a" ]
then
echo "Usage: script [output folder]"
exit 1
fi
mkdir -p "$folder"
ts=`date +%s`
npm start 'http://www.linuxelite.com.br/' "$folder/mal-$ts" 2000
npm start 'https://eenteslavoorsimon.be/' "$folder/mal-$ts" 2000
npm start 'https://news.google.com/news/?ned=us&gl=US&hl=en' "$folder/good-$ts" 2000
npm start https://www.youtube.com/watch?v=v_mOkUk5CDw "$folder/good-vid-$ts" 2000
npm start 'http://abcnews.go.com/US/pastor-church-attended-25000-steps-amid-misconduct-allegations/story?id=54383250' "$folder/good-ad-$ts" 2000
npm start 'http://bitcointicker.co/' "$folder/good-ui-$ts" 2000
npm start 'https://stackoverflow.com/questions/3216013/get-the-last-item-in-an-array' "$folder/good-$ts" 2000
npm start 'https://www.choosechicago.com/restaurants/' "$folder/good-$ts" 2000
npm start 'http://189.26.255.57:8081/' "$folder/mal-$ts" 2000
npm start 'http://188.65.210.23:8081/' "$folder/mal-$ts" 2000
