import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.setBrowserExecutable(null);

export default {
  codec: "h264",
  crf: 18,
  audio: false,
};
