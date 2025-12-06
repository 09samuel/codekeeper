import { TestBed } from '@angular/core/testing';

import { CollaboratorRealtimeService } from './collaborator-realtime-service';

describe('CollaboratorRealtimeService', () => {
  let service: CollaboratorRealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CollaboratorRealtimeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
