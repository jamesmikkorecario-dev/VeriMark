import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { NavigationDisclosure } from './Layouts';
afterEach(cleanup);
describe('nonmodal navigation disclosure',()=>{
 it('exposes links on activation, closes with Escape and restores trigger focus',()=>{
 render(<MemoryRouter><NavigationDisclosure id="test-nav" label="Menu"><a href="/">Home</a></NavigationDisclosure><button>Background action</button></MemoryRouter>);
 const trigger=screen.getByRole('button',{name:'Menu'});trigger.focus();fireEvent.click(trigger);
 expect(trigger.getAttribute('aria-expanded')).toBe('true');screen.getByRole('link',{name:'Home'}).focus();
 fireEvent.keyDown(screen.getByRole('link'),{key:'Escape'});
 expect(screen.queryByRole('link')).toBeNull();expect(document.activeElement).toBe(trigger);
 expect(screen.getByRole('button',{name:'Background action'}).closest('[inert]')).toBeNull();
 });
});
