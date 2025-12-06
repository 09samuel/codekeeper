import { TestBed } from '@angular/core/testing';

import { CollaboratorStoreService } from './collaborator-store-service';

describe('CollaboratorStoreService', () => {
  let service: CollaboratorStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CollaboratorStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
