import { Component, inject } from '@angular/core';
import { UndoService } from '../../../core/services/undo/undo.service';

/** Le bandeau différé (§6.7), en bas au centre, au-dessus de tout écran : une seule instance, dans `AppComponent` */
@Component({
  selector: 'app-undo-banner',
  templateUrl: './undo-banner.html',
})
export class UndoBanner {
  protected undo = inject(UndoService);
  protected state = this.undo.state;
}
