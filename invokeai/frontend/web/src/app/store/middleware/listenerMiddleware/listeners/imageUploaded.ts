import { logger } from 'app/logging/logger';
import type { AppStartListening } from 'app/store/middleware/listenerMiddleware';
import type { RootState } from 'app/store/store';
import { selectListBoardsQueryArgs } from 'features/gallery/store/gallerySelectors';
import { boardIdSelected, galleryViewChanged } from 'features/gallery/store/gallerySlice';
import { toast } from 'features/toast/toast';
import { t } from 'i18next';
import { omit } from 'lodash-es';
import { boardsApi } from 'services/api/endpoints/boards';
import { imagesApi } from 'services/api/endpoints/images';

const log = logger('gallery');

/**
 * Gets the description for the toast that is shown when an image is uploaded.
 * @param boardId The board id of the uploaded image
 * @param state The current state of the app
 * @returns
 */
const getUploadedToastDescription = (boardId: string, state: RootState) => {
  if (boardId === 'none') {
    return t('toast.addedToUncategorized');
  }
  // Attempt to get the board's name for the toast
  const queryArgs = selectListBoardsQueryArgs(state);
  const { data } = boardsApi.endpoints.listAllBoards.select(queryArgs)(state);
  // Fall back to just the board id if we can't find the board for some reason
  const board = data?.find((b) => b.board_id === boardId);

  return t('toast.addedToBoard', { name: board?.board_name ?? boardId });
};

let lastUploadedToastTimeout: number | null = null;

export const addImageUploadedFulfilledListener = (startAppListening: AppStartListening) => {
  startAppListening({
    matcher: imagesApi.endpoints.uploadImage.matchFulfilled,
    effect: (action, { dispatch, getState }) => {
      const imageDTO = action.payload;
      const state = getState();

      log.debug({ imageDTO }, 'Image uploaded');

      if (action.meta.arg.originalArgs.silent || imageDTO.is_intermediate) {
        // When a "silent" upload is requested, or the image is intermediate, we can skip all post-upload actions,
        // like toasts and switching the gallery view
        return;
      }

      const boardId = imageDTO.board_id ?? 'none';

      const DEFAULT_UPLOADED_TOAST = {
        id: 'IMAGE_UPLOADED',
        title: t('toast.imageUploaded'),
        status: 'success',
      } as const;

      // default action - just upload and alert user
      if (lastUploadedToastTimeout !== null) {
        window.clearTimeout(lastUploadedToastTimeout);
      }
      const toastApi = toast({
        ...DEFAULT_UPLOADED_TOAST,
        title: DEFAULT_UPLOADED_TOAST.title,
        description: getUploadedToastDescription(boardId, state),
        duration: null, // we will close the toast manually
      });
      lastUploadedToastTimeout = window.setTimeout(() => {
        toastApi.close();
      }, 3000);

      /**
       * We only want to change the board and view if this is the first upload of a batch, else we end up hijacking
       * the user's gallery board and view selection:
       * - User uploads multiple images
       * - A couple uploads finish, but others are pending still
       * - User changes the board selection
       * - Pending uploads finish and change the board back to the original board
       * - User is confused as to why the board changed
       *
       * Default to true to not require _all_ image upload handlers to set this value
       */
      const isFirstUploadOfBatch = action.meta.arg.originalArgs.isFirstUploadOfBatch ?? true;
      if (isFirstUploadOfBatch) {
        dispatch(boardIdSelected({ boardId }));
        dispatch(galleryViewChanged('assets'));
      }
    },
  });

  startAppListening({
    matcher: imagesApi.endpoints.uploadImage.matchRejected,
    effect: (action) => {
      const sanitizedData = {
        arg: {
          ...omit(action.meta.arg.originalArgs, ['file', 'postUploadAction']),
          file: '<Blob>',
        },
      };
      log.error({ ...sanitizedData }, 'Image upload failed');
      toast({
        title: t('toast.imageUploadFailed'),
        description: action.error.message,
        status: 'error',
      });
    },
  });
};
