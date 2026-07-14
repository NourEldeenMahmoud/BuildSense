import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '../app/app.component';
import { visualAppConfig } from './visual.config';

bootstrapApplication(AppComponent, visualAppConfig).catch((err) => console.error(err));
