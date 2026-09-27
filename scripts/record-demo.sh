#!/usr/bin/env bash
# Records a demo flow on the booted iOS simulator and turns it into a GIF for the README.
#   scripts/record-demo.sh explore      -> docs/demos/explore.gif
# Needs Maestro, ffmpeg and the app running on the simulator. Resets the app's state.
set -euo pipefail
name="$1"
app_id="com.usthing.apptechtest27"
out_dir="docs/demos"
tmp="$(mktemp -d)"
mkdir -p "$out_dir"

xcrun simctl ui booted appearance light
xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100

# Fresh state first, so the recording starts on a settled screen, not an app launch.
maestro test -e MAESTRO_APP_ID="$app_id" .maestro/demos/_setup.yaml > /dev/null

xcrun simctl io booted recordVideo --codec=h264 --force "$tmp/raw.mp4" 2> /dev/null &
recorder=$!
# Never leave a recording running (a second one fails with "Resource busy").
trap 'kill -INT "$recorder" 2> /dev/null || true' EXIT
sleep 1
maestro test -e MAESTRO_APP_ID="$app_id" ".maestro/demos/$name.yaml" > /dev/null
kill -INT "$recorder"
wait "$recorder" || true

# Trim the still frames before the first tap and after the last change (keeping a short
# hold at the end), play at 1.5x, and encode 320 px wide at 15 fps with a palette built
# from the clip for clean colours.
freezes="$(ffmpeg -hide_banner -i "$tmp/raw.mp4" -vf freezedetect=n=0.003:d=0.8 -map 0:v -f null - 2>&1)"
duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/raw.mp4")"
start="$(echo "$freezes" | awk '/freeze_start: 0(\.|$)/{f=1} f && /freeze_end/{print $NF; exit}')"
last_start="$(echo "$freezes" | awk '/freeze_start/{s=$NF} END{print s}')"
start="$(awk -v s="${start:-0}" 'BEGIN{print (s > 0.3 ? s - 0.3 : 0)}')"
end="$(awk -v l="${last_start:-0}" -v d="$duration" 'BEGIN{print (l > 0 && l + 1.2 < d ? l + 1.2 : d)}')"

ffmpeg -loglevel error -y -ss "$start" -to "$end" -i "$tmp/raw.mp4" -vf \
  "setpts=PTS/1.5,fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$out_dir/$name.gif"
seconds="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out_dir/$name.gif")"
echo "$out_dir/$name.gif: ${seconds%.*} s, $(du -h "$out_dir/$name.gif" | cut -f1)"
