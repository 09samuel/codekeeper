import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeRunner } from './code-runner';

describe('CodeRunner', () => {
  let component: CodeRunner;
  let fixture: ComponentFixture<CodeRunner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeRunner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CodeRunner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
