import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, map, tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settingFetcher: Observable<any>;

  constructor(private http: HttpClient) {
    this.settingFetcher = this.http.get('/api/settings').pipe(
      shareReplay(1),
    );
  }

  getFhirId(): Observable<string> {
    return this.settingFetcher.pipe(
      map(res => {
        console.error(res);
        return res['fhirClientId'] ? res['fhirClientId'] : 'fakeId';
      }),
    );
  }

  getUiConfig(): Observable<object> {
    return this.settingFetcher.pipe(
      map(res => {
        const showChat = res['showChat']
        console.error(showChat);
        return { showChat };
      }),
    );
  }
}
