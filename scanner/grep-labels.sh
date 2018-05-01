(
	for i in $*;
	do
	grep -r Label . | grep -P -i $i | grep --color=always Label;
	done
) | less -R
