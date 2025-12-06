import { TestBed } from '@angular/core/testing';

import { AddCollaboratorService } from './add-collaborator-service';

describe('AddCollaboratorService', () => {
  let service: AddCollaboratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AddCollaboratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
