import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileDialog } from './file-dialog';

describe('FileDialog', () => {
  let component: FileDialog;
  let fixture: ComponentFixture<FileDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
