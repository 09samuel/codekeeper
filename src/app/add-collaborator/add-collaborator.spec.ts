import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCollaborator } from './add-collaborator';

describe('AddCollaborator', () => {
  let component: AddCollaborator;
  let fixture: ComponentFixture<AddCollaborator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCollaborator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCollaborator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
