import {
  Text,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Button,
  Switch,
  FormControl,
  FormLabel,
  Flex,
} from '@chakra-ui/react';
import { createSelector } from '@reduxjs/toolkit';
import { ChangeEvent, ReactElement, SyntheticEvent } from 'react';
import { cloneElement, forwardRef, useRef } from 'react';
import { useAppDispatch, useAppSelector } from 'app/storeHooks';
import { deleteImage } from 'app/socketio/actions';
import { RootState } from 'app/store';
import {
  setShouldConfirmOnDelete,
  SystemState,
} from 'features/system/store/systemSlice';
import * as InvokeAI from 'app/invokeai';
import { useHotkeys } from 'react-hotkeys-hook';
import _ from 'lodash';

const systemSelector = createSelector(
  (state: RootState) => state.system,
  (system: SystemState) => {
    const { shouldConfirmOnDelete, isConnected, isProcessing } = system;
    return { shouldConfirmOnDelete, isConnected, isProcessing };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: _.isEqual,
    },
  }
);
interface DeleteImageModalProps {
  /**
   *  Component which, on click, should delete the image/open the modal.
   */
  children: ReactElement;
  /**
   * The image to delete.
   */
  image?: InvokeAI.Image;
}

/**
 * Needs a child, which will act as the button to delete an image.
 * If system.shouldConfirmOnDelete is true, a confirmation modal is displayed.
 * If it is false, the image is deleted immediately.
 * The confirmation modal has a "Don't ask me again" switch to set the boolean.
 */
const DeleteImageModal = forwardRef(
  ({ image, children }: DeleteImageModalProps, ref) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const dispatch = useAppDispatch();
    const { shouldConfirmOnDelete, isConnected, isProcessing } =
      useAppSelector(systemSelector);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const handleClickDelete = (e: SyntheticEvent) => {
      e.stopPropagation();
      shouldConfirmOnDelete ? onOpen() : handleDelete();
    };

    const handleDelete = () => {
      if (isConnected && !isProcessing && image) {
        dispatch(deleteImage(image));
      }
      onClose();
    };

    useHotkeys(
      'delete',
      () => {
        shouldConfirmOnDelete ? onOpen() : handleDelete();
      },
      [image, shouldConfirmOnDelete]
    );

    const handleChangeShouldConfirmOnDelete = (
      e: ChangeEvent<HTMLInputElement>
    ) => dispatch(setShouldConfirmOnDelete(!e.target.checked));

    return (
      <>
        {cloneElement(children, {
          // TODO: This feels wrong.
          onClick: image ? handleClickDelete : undefined,
          ref: ref,
        })}

        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={cancelRef}
          onClose={onClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent className="modal">
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete image
              </AlertDialogHeader>

              <AlertDialogBody>
                <Flex direction={'column'} gap={5}>
                  <Text>
                    Are you sure? Deleted images will be sent to the Bin. You
                    can restore from there if you wish to.
                  </Text>
                  <FormControl>
                    <Flex alignItems={'center'}>
                      <FormLabel mb={0}>Don't ask me again</FormLabel>
                      <Switch
                        checked={!shouldConfirmOnDelete}
                        onChange={handleChangeShouldConfirmOnDelete}
                      />
                    </Flex>
                  </FormControl>
                </Flex>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button
                  ref={cancelRef}
                  onClick={onClose}
                  className="modal-close-btn"
                >
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={handleDelete} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </>
    );
  }
);

export default DeleteImageModal;
