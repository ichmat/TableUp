import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeOnly',
})
export class TimeOnlyPipe implements PipeTransform {
  /**
   * Adapate l'affichage des valeurs time only. Par défaut `hh:mm`
   * @param value la valeur time only
   * @param format Utiliser `hh`, `mm` et `ss` pour customiser l'affichage.
   * Exemple : `hh:mm`
   * @returns 
   */
  transform(value: string, format?: string): string {
    format ??= "hh:mm";

    const splitted = value.split(':');

    if(splitted.length !== 3){
      throw new Error("la valeur donnée n'est pas un TimeOnly")
    }

    const splittedFormat = format.split(':');
    let result = "";

    splittedFormat.forEach(f => {
      switch(f.toLowerCase()){
        case 'hh':
          result = this.join(result, splitted[0]);
          break;
        case 'mm':
          result = this.join(result, splitted[1]);
          break;
        case 'ss':
          result = this.join(result, splitted[2]);
          break;
      }
    });

    return result;
  }

  private join(str1: string, str2: string): string {
    if(str1.length > 0){
      return str1 + ':' + str2;
    }
    return str2;
  }
}
