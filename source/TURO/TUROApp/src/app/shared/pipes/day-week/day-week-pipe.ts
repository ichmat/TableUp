import { Pipe, PipeTransform } from '@angular/core';
import { DayWeek } from '../../../models';

@Pipe({
  name: 'dayWeekPipe',
  standalone: true
})
export class DayWeekPipe implements PipeTransform {
  transform(value: DayWeek): string {
    switch(value){
      case 'Monday':
        return "Lundi";
      case 'Tuesday':
        return "Mardi";
      case 'Wednesday':
        return "Mercredi";
      case 'Thursday':
        return "Jeudi";
      case 'Friday':
        return "Vendredi";
      case 'Saturday':
        return "Samedi";
      case 'Sunday':
        return "Dimanche"
      default: 
        throw new Error(`dayweek value ${value} not supported`);
    }
  }
}
