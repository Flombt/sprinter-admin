'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function IdleWarning({ onStay }: { onStay: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onStay()}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>Toujours là ?</DialogTitle>
          <DialogDescription>Sans activité, vous serez déconnecté dans moins de 2 minutes.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="primary" onClick={onStay}>
            Rester connecté
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
