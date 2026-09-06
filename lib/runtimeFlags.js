/** Flag runtime chia sẻ giữa UI cấu hình và engine (không persist, không state React). */

const flags = {
  autoDuration: true,
};

export function setAutoDurationEnabled(on) {
  flags.autoDuration = on !== false;
}

export function isAutoDurationEnabled() {
  return flags.autoDuration !== false;
}

export default flags;