import * as Sharing from 'expo-sharing';
import { Image, PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  SHARE_LAYOUT_WIDTH,
  SHARE_SIZES,
  shareLayoutSize,
  type ShareFormat,
} from '@/components/share-card';

/**
 * Render the off-screen share card to a PNG at the design's exact pixel
 * sizes and hand it to the system share sheet.
 *
 * captureRef takes LOGICAL pixels, so the target physical size is divided by
 * the device's pixel ratio — otherwise a 3x phone would produce a 3240px
 * image and a 2x phone a 2160px one, when the design calls for exactly 1080.
 */
export async function captureAndShare(
  ref: React.RefObject<any>,
  format: ShareFormat,
): Promise<void> {
  const target = SHARE_SIZES[format];
  const layout = shareLayoutSize(format);
  const ratio = PixelRatio.get();

  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: target.width / ratio,
    height: target.height / ratio,
  });

  // The design specifies exact pixel sizes; verify rather than assume, since
  // captureRef takes logical pixels and a wrong device ratio silently yields
  // a 2160px or 3240px export that no longer matches the spec.
  Image.getSize(
    uri,
    (w, h) =>
      console.log(
        `[SHARE] ${format} exported ${w}x${h} (target ${target.width}x${target.height})` +
          (w === target.width && h === target.height ? ' ✓' : ' ✗ MISMATCH'),
      ),
    () => {},
  );

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share scan',
    UTI: 'public.png',
  });
}

export { SHARE_LAYOUT_WIDTH, shareLayoutSize };
export type { ShareFormat };
