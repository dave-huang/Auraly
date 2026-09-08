import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * The label photograph, kept on this device only.
 *
 * Every scan photographs a real ingredient label and, until now, the app threw
 * it away the moment the verdict landed — so history was a grid of typography
 * about products the person had physically held. The most credible image this
 * app can show is the specimen itself, and it already had one.
 *
 * IT NEVER LEAVES THE PHONE.
 *
 * `scans.original_image_url` exists on the server and stays unused. That is
 * deliberate, not an oversight: a photograph of a packet also catches kitchen
 * counters, hands, mail on the table and whatever is behind it. Uploading that
 * turns a health app into a photo host, drags the label shot into the privacy
 * policy, the Washington MHMDA consent work and the App Store data disclosure,
 * and buys a thumbnail. Kept local it is none of those things — it is a cache,
 * and it can be deleted by deleting the app.
 *
 * Consequences of that choice, both correct:
 *   - a scan opened on a second device shows no photograph, because the
 *     photograph is not part of the record, and
 *   - deleting the account does not need to reach these, though `clearAll`
 *     exists so sign-out can.
 */

const DIR_NAME = 'label-thumbnails';

/**
 * Wide enough for a full-bleed backdrop on the largest phone, small enough
 * that a few hundred of them are still measured in megabytes.
 */
const MAX_WIDTH = 480;
const QUALITY = 0.6;

/**
 * How many to keep.
 *
 * An unbounded cache of photographs on someone's phone is a bug that takes a
 * year to show up and is then very hard to explain. History paginates, so the
 * ones worth holding are the recent ones; older scans simply render without a
 * backdrop, exactly as they did before any of this existed.
 */
const KEEP = 200;

function directory(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function fileFor(scanId: string): File {
  // Scan ids are server UUIDs, but this builds a filesystem path, so it is
  // sanitised rather than trusted — a stray separator here would write outside
  // the directory.
  return new File(directory(), `${scanId.replace(/[^a-zA-Z0-9-]/g, '')}.jpg`);
}

/**
 * Downscale the captured frame and keep it against a scan id.
 *
 * NEVER THROWS. This is a decoration on a verdict that has already been
 * delivered; a failure to cache a picture must not surface as an error on a
 * screen that just told someone whether they can eat something.
 */
export async function saveLabelThumbnail(scanId: string, sourceUri: string): Promise<void> {
  try {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: MAX_WIDTH });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

    const target = fileFor(scanId);
    if (target.exists) target.delete();
    new File(saved.uri).move(target);
  } catch (error) {
    console.warn('[THUMBNAIL] could not save', error);
  }
}

/** The local path for a scan's label photo, or null when there is none. */
export function labelThumbnailUri(scanId: string): string | null {
  try {
    const file = fileFor(scanId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Drop one, when its scan is deleted. */
export function deleteLabelThumbnail(scanId: string): void {
  try {
    const file = fileFor(scanId);
    if (file.exists) file.delete();
  } catch {
    // A thumbnail that will not delete is a cache entry, not a leak of
    // anything the server holds. Never worth failing a deletion over.
  }
}

/**
 * Trim to the most recent KEEP files.
 *
 * Ordered by modification time rather than by asking the server which scans
 * still exist: this must work offline, and being slightly generous with a
 * cache is much better than deleting a photo whose scan is merely unreachable
 * right now.
 */
export function pruneLabelThumbnails(): void {
  try {
    const files = directory()
      .list()
      .filter((entry): entry is File => entry instanceof File);
    if (files.length <= KEEP) return;

    files
      .map((file) => ({ file, at: file.modificationTime ?? 0 }))
      .sort((a, b) => b.at - a.at)
      .slice(KEEP)
      .forEach(({ file }) => file.delete());
  } catch {
    // Best effort by definition.
  }
}

/** Remove every stored label photo — used on sign-out. */
export function clearLabelThumbnails(): void {
  try {
    const dir = new Directory(Paths.document, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // As above.
  }
}
